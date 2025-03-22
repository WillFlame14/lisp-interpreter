(defn empty? [list] (= (count list) 0))

(defn map [f list]
  (if (empty? list)
    list
    (cons (f (peek list)) (map f (pop list)))))
