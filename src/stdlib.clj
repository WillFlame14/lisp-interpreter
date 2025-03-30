(defn empty? [list] (= (count list) 0))

(defn map [f list]
  (if (empty? list)
    list
    (cons (f (peek list)) (map f (pop list)))))

(defn filter [f list]
  (if (empty? list)
    list
    (let [head (peek list)
          rest (filter f (pop list))]
      (if (f head) 
        (cons head rest)
        rest))))

(defn not [x] (if x false true))

(defn concat [x y]
  (if (empty? x)
    y
    (cons (peek x) (concat (pop x) y))))

(defn not= [x y] (not (= x y)))

(defn inc [x] (+ x 1))

(defn dec [x] (- x 1))
