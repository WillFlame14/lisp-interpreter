(let [empty? (fn [list] (= (count list) 0))
      replace (fn rec [f list]
                (if (empty? list)
                  list
                  (cons (f (peek list)) (rec f (pop list)))))]
  (print (replace (fn [x] (+ x 2)) (quote (1 2 3)))))